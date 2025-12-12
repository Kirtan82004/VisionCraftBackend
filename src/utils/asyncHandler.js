const asyncHandler = (requestHandler) => async (req,res,next)=>{
    try {
        await requestHandler(req,res,next)
    } catch (error) {
        console.error("Caught Error:", error);
        res.status(error.code >= 100 && error.code < 600 ? error.code : 500).json({
            success:false,
            message:error.message

        })
    }

}



export {asyncHandler}