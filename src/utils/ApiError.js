class ApiError extends Error{
    constructor(
        statusCode,
        message="Something went wrong",
        errors=[],
        stack=""
    ){
        if(statusCode<100 || statusCode >599){
            throw new Error("Invalid status code");
        }
        super(message);
        this.statusCode=statusCode;
        this.data=null;
        this.message=message;
        this.success=false;
        this.errors=errors;

        if(stack){
            this.stack=stack;
        }else{
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export {ApiError}