"use server"

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import { connectDB } from "../mongoose"
import Thread from "../models/thread.model";
import { error } from "console";

interface Params {
    text: string,
    author:string,
    communityId: string | null,
    path: string,
}

// create thread
export async function createThread({
    text,author,communityId,path
}:Params){
    connectDB();
    try{

        const createdThread = await Thread.create({
            text,
            author,
            community:null,
        });
    
        //update user model
    
        await User.findByIdAndUpdate(author,{
            $push: {threads: createdThread._id}
        })
    
        revalidatePath(path)
    }catch(error:any){
        throw new Error(`Error creating thread: ${error.message}`)
    }
}

// fetch threads/ post
export async function fetchPosts(pageNumber =1, pageSize =20){
    connectDB();

    // cal num of post to skip
    const skipAmount = (pageNumber - 1) * pageSize

    // fetch post that have no parents (threads without comment)
    const postQuery = Thread.find({parentId:{$in:[null, undefined]}})
    .sort({createdAt:'desc'})
    .skip(skipAmount)
    .limit(pageSize)
    .populate({path:'author', model:User})
    .populate({
        path: 'children',
        populate:{
            path:'author',
            model: User,
            select:"_id name parentId image"
        }
    })

    const totalPostCount = await Thread.countDocuments({parentId:{$in:[null, undefined]}})
    const posts = await postQuery.exec()

    const isNext = totalPostCount > skipAmount + posts.length;

    return {
        posts, isNext
    }


}


// fetch thread by id
export async function fetchThreadById(id: string){
    connectDB();

    try {
        //populate community
        //populate post and it commnet
        const thread = await Thread.findById(id).populate({
            path:'author',
            model:User,
            select:"_id id name image"
        }).populate({
            path:'children',
            populate:[
                {
                    path:'author',
                    model: User,
                    select:"_id id name parentId image"
                },
                {
                    path:'children',
                    model:Thread,
                    populate:{
                        path:'author',
                        model:User,
                        select:"_id id name parentId image"
                    }
                }
            ]
        }).exec();

        return thread;
    } catch (error:any) {
        throw new Error(`Error fetching thread: ${error.message}`)
    }
}

// add comments to the thread
export async function addCommentToThread(
    threadId:string,
    commentText:string,
    userId:string,
    path:string,
    ){
        connectDB();

        try {
            //find thread
            const originalThread = await Thread.findById(threadId);
            if(!originalThread){
                throw new Error("Thread not found")
            }

            //adding a comment
            const commentThread = new Thread({
                text:commentText,
                author: userId,
                parentId: threadId
            })

            //save the new thread
            const savedCommentThread = await commentThread.save()

            //update the original thread to include the new comment
            originalThread.children.push(savedCommentThread._id
                );

            // save the original thread
            await originalThread.save()

            revalidatePath(path);
            
        } catch (error:any) {
            throw new Error(`Error adding comment to thread ${error.message}`)
        }
    }