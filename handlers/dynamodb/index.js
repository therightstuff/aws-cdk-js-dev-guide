const aws = require('aws-sdk');
if (process.env.AWS_LOCAL_DEV == "true") {
    ddbConfigOptions.endpoint = process.env.LOCAL_DDB_URL;
    ddbConfigOptions.accessKeyId = process.env.LOCAL_DDB_ACCESS_KEY_ID;
    ddbConfigOptions.secretAccessKey = process.env.LOCAL_DDB_SECRET_ACCESS_KEY;
}
const dynamodb = new aws.DynamoDB.DocumentClient();
const uuid = require('uuid').v4;

const TTL_IN_SECONDS = 60;

function getExpirationTime() {
    return Math.floor(Date.now() / 1000) + TTL_IN_SECONDS;
}

exports.handler = async (event) => {
    console.log(event);
    const promise = new Promise(function(resolve, reject) {
        let payload = null;
        try {
            payload = JSON.parse(event.body);
        } catch (err) {
            return reject("unable to parse request body, expected valid JSON format");
        }

        let method = "GET";

        switch (method) {
            case "GET":
                console.log("entering GET black");
                // scan the table for unexpired results
                let result = await dynamodb.scan({
                    TableName: process.env.TABLE_NAME
                }).promise();
                return resolve(result);
            case "POST":
                console.log("entering POST black");
                // add a new object to the table
                let result = await dynamodb.put({
                    TableName: process.env.TABLE_NAME,
                    Item: {
                        "id": uuid(),
                        "payload": payload,
                        "expiration": getExpirationTime()
                    }
                }).promise();

                return resolve(result);
            default:
                return reject(`unsupported request method ${method}`);
        }
    });
    return promise;
}