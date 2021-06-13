const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();
const utils = require('/opt/nodejs/sample-layer/utils');

const TABLE_NAME = process.env.TABLE_NAME;
const DDB_GSI_NAME = process.env.DDB_GSI_NAME;
const TTL_IN_SECONDS = 60;

function getExpirationTime() {
    return Math.floor(Date.now() / 1000) + TTL_IN_SECONDS;
}

let corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
    'Access-Control-Allow-Credentials': true,
};

exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        let payload = null;
        try {
            payload = JSON.parse(event.body);
        } catch (err) {
            return resolve(utils.createResponse({
                "statusCode": 400,
                "headers": corsHeaders,
                "body": {
                    "success": false,
                    "reason": "unable to parse request body, expected valid JSON format"
                }
            }));
        }

        // if the table has partition and sort keys and we don't have both of
        // them then we will need to use an appropriate secondary index. it is
        // not possible to update an object directly using the global secondary
        // index, so we must first query it for the object and then update the
        // base table.
        // in other words, if the table only has a partition key or you wish to
        // update using both the partition key and the sort key, there's no
        // need for any querying beforehand and no need for read permissions
        // on the table either.
        console.log(`querying table index`);
        dynamodb.query({
            TableName: TABLE_NAME,
            IndexName: DDB_GSI_NAME,
            KeyConditionExpression: 'objectId = :obj_id',
            ExpressionAttributeValues: { ':obj_id': event.pathParameters.objectId }
        }).promise()
        .then(result => {
            if (result.Items.length > 0) {
                let item = result.Items[0];

                dynamodb.update({
                    TableName: TABLE_NAME,
                    Key: {
                        "dataOwner": item.dataOwner,
                        "objectId": item.objectId
                    },
                    UpdateExpression: "set payload = :p, expiration = :x",
                    ExpressionAttributeValues: {
                        ":p": payload,
                        ":x": getExpirationTime()
                    }
                }).promise()
                .then(() => {
                    resolve(utils.createResponse({
                        "statusCode": 200,
                        "headers": corsHeaders,
                        "body": {
                            "success": true
                        }
                    }));
                })
                .catch((err) => {
                    console.error(err);
                    resolve(utils.createResponse({
                        "statusCode": 500,
                        "headers": corsHeaders,
                        "body": {
                            "success": false,
                            "reason": "an unexpected error occurred",
                            "error": err
                        }
                    }));
                });
            } else {
                resolve(utils.createResponse({
                    "statusCode": 500,
                    "headers": corsHeaders,
                    "body": {
                        "success": false,
                        "reason": "object not found"
                    }
                }));
            }
        })
        .catch((err) => {
            console.error(err);
            resolve(utils.createResponse({
                "statusCode": 500,
                "headers": corsHeaders,
                "body": {
                    "success": false,
                    "reason": "an unexpected error occurred",
                    "error": err
                }
            }));
        });
    });
    return promise;
}