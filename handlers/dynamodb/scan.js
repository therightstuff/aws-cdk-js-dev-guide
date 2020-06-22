const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;

function createResponse(status, json) {
    return {
        "isBase64Encoded": false,
        "statusCode": status,
        "headers": {},
        "body": JSON.stringify(json)
    }
}

exports.handler = async (event) => {
    const promise = new Promise(function(resolve, reject) {
        // scan the table for unexpired results
        dynamodb.scan({
            TableName: TABLE_NAME
        }).promise()
        .then((data) => {
            resolve(
                createResponse(200, data.Items)
            );
        })
        .catch(reject);
    });
    return promise;
}
