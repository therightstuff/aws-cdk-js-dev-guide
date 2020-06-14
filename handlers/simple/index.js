exports.handler = async (event) => {
    console.log("starting simple js");
    console.log(event);
    const promise = new Promise(function(resolve, reject) {
        let localResponse = "";
        if (process.env.AWS_LOCAL_DEV == "true") {
            localResponse = "\nThis lambda function is being called locally!"
        }
        return resolve({
            "simpleResponse": `${process.env.HELLO}, ${process.env.WORLD}!${localResponse}`
        });
    });
    return promise;
}