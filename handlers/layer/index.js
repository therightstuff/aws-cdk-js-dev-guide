const aws = require('aws-sdk');
const uuid = require('uuid').v4;

exports.handler = async (event) => {
    const promise = new Promise(function(resolve, reject) {
        return resolve({
            "generatedId": uuid()
        });
    });
    return promise;
}