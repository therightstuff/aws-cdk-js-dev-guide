const aws = require('aws-sdk');
const uuid = require('uuid').v4;

exports.handler = async (event) => {
    console.log(event);
    const promise = new Promise(function(resolve, reject) {
        return resolve({
            "responseId": uuid()
        });
    });
    return promise;
}