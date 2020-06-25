const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();
const utils = require('/opt/nodejs/sample-layer/utils');

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        // scan the table for unexpired results
        dynamodb.scan({
            TableName: TABLE_NAME
        }).promise()
        .then((data) => {
            resolve(utils.createResponse({
                "statusCode": 200,
                "body": data.Items
            }));
        })
        .catch(reject);
    });
    return promise;
}
