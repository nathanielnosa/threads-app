"use server"

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import { connectDB } from "../mongoose"
import Thread from "../models/thread.model";
import { FilterQuery, SortOrder } from "mongoose";


interface Params{
    userId: string,
    username: string,
    name: string,
    bio: string,
    image: string,
    path: string
}

// update a user
export async function updateUser({

    userId,
    username,
    name,
    bio,
    image,
    path
}: Params): Promise<void> {
    connectDB();

    try{
        
    await User.findOneAndUpdate(
        {id:userId},
        {
            username:username.toLowerCase(),
            name,
            bio,
            image,
            onboarded:true,
        },
        {upsert: true}
        );

    if(path === '/profile/edit'){
        revalidatePath(path)
    }

    }catch(error:any){
        throw new Error(`Failed to create/update use: ${error.message}`);
    }

}

// get a single user
export async function fetchUser(userId:string){
    try {
        connectDB();
        return await User
        .findOne({id:userId})
        // .populate({
        //     path:'communities',
        //     model:Community
        // })
    } catch (error:any) {
        throw new Error(`Failed to fetch user ${error.message}`)   
    }
}

// get users post
export async function fetchUserPosts(userId:string) {
    try {
        connectDB();

        // all thread authored by user with given Id
        const threads = await User.findOne({id:userId})
        .populate({
            path:'threads',
            model: Thread,
            populate:{
                path:'children',
                model:Thread,
                populate:{
                    path:'author',
                    model:User,
                    select:'name image id'
                }
            }
        })
        return threads
    } catch (error:any) {
        throw new Error(`Failed to fetch post ${error.message}`)
    }
}
// get users
export async function fetchUsers({
    userId,
    searchString = "",
    pageNumber = 1,
    pageSize = 20,
    sortBy = "desc"
}: {
    userId:string;
    searchString?:string;
    pageNumber?:number
    pageSize?:number
    sortBy?:SortOrder
}){
    try {
        connectDB();


        const skipAmount = (pageNumber - 1) * pageSize
        const regex = new RegExp(searchString,'i');

        const query:FilterQuery<typeof User> ={
            id: {$ne : userId}
        }

        if(searchString.trim() !==''){
            query.$or = [
                {username:{$regex: regex}},
                {name: {$regex: regex}}
            ]
        }

        const sortOptions = {createdAt:sortBy}
        const userQuery = User.find(query)
        .sort(sortOptions)
        .skip(skipAmount)
        .limit(pageSize)

        const totalUserCount = await User.countDocuments(query);

        const users = await userQuery.exec();

        const isNext = totalUserCount > skipAmount + users.length
        return{
            users,
            isNext
        }

    } catch (error:any) {
        throw new Error(`Failed to fetch users ${error.message}`)
    }
}

// get user activity or notification
export async function getActivity(userId:string){
    try {
        connectDB();

        // find all threads created by user
        const userThreads = await Thread.find({author:userId});

        // collect all the child thread ids (replies) from the children fields
        const childThreadIds = userThreads.reduce((acc,userThread) => {
            return acc.concat(userThread.children)
        },[])
        
        // all replies
        const replies = await Thread.find({
            _id:{$in: childThreadIds},
            author:{$ne:userId}
        }).populate({
            path: 'author',
            model: User,
            select: 'name image id'
        })

        return replies

    } catch (error:any) {
        throw new Error(`Failed to fetch activity: ${error.message}`)
    }
}