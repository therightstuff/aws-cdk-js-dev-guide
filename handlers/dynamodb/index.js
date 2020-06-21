const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();
const uuid = require('uuid').v4;

const TTL_IN_SECONDS = 60;

function getExpirationTime() {
    return Math.floor(Date.now() / 1000) + TTL_IN_SECONDS;
}

exports.scan = async (event) => {
    const promise = new Promise(function(resolve, reject) {
        let payload = null;
        try {
            payload = JSON.parse(event.body);
        } catch (err) {
            return reject("unable to parse request body, expected valid JSON format");
        }

        // scan the table for unexpired results
        let result = await dynamodb.scan({
            TableName: process.env.TABLE_NAME
        }).promise();
        return resolve({
            "isBase64Encoded": false,
            "statusCode": 200,
            "headers": {},
            "body": JSON.stringify(result)
        });
    });
    return promise;
}

exports.update = async (event) => {
    const promise = new Promise(function(resolve, reject) {
        let payload = null;
        try {
            payload = JSON.parse(event.body);
        } catch (err) {
            return reject("unable to parse request body, expected valid JSON format");
        }

        // see https://stackoverflow.com/a/61295108/2860309
        let method = null;
        try {
            method = event.requestContext.http.method
        } catch (e) {}

        // add a new object to the table
        let result = await dynamodb.put({
            TableName: process.env.TABLE_NAME,
            Item: {
                "id": uuid(),
                "payload": payload,
                "method": method,
                "expiration": getExpirationTime()
            }
        }).promise();

        return resolve({
            "isBase64Encoded": false,
            "statusCode": 200,
            "headers": {},
            "body": JSON.stringify(result)
        });
    });
    return promise;
}