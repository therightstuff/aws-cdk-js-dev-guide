const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB.DocumentClient();
const utils = require('/opt/nodejs/sample-layer/utils');

const TABLE_NAME = process.env.TABLE_NAME;
const DDB_GSI_NAME = process.env.DDB_GSI_NAME;

let corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
    'Access-Control-Allow-Credentials': true,
};

exports.handler = async (event) => {
    const promise = new Promise((resolve, reject) => {
        // to query the object, we require either the dataOwner and objectId (base table query),
        // or the objectId (index query).
        let getParams;
        let queryParams;
        if (event.queryStringParameters.dataOwner) {
            // if we have the partition and sort keys, we can "get" the object directly
            getParams = {
                TableName: TABLE_NAME,
                Key: {
                    "dataOwner": event.queryStringParameters.dataOwner,
                    "objectId": event.pathParameters.objectId
                }
            };
            // or we can query the base table
            queryParams = {
                TableName: TABLE_NAME,
                KeyConditionExpression: 'dataOwner = :owner_id and objectId = :obj_id',
                ExpressionAttributeValues: {
                    ':owner_id': event.queryStringParameters.dataOwner,
                    ':obj_id': event.pathParameters.objectId
                }
            };
        } else {
            // if we don't have both partition and sort keys, we must query using an
            // appropriate secondary index
            console.log(`querying table index`);
            queryParams = {
                TableName: TABLE_NAME,
                IndexName: DDB_GSI_NAME,
                KeyConditionExpression: 'objectId = :obj_id',
                ExpressionAttributeValues: { ':obj_id': event.pathParameters.objectId }
            };
        }

        let promise = getParams ?
            dynamodb.get(getParams).promise() :
            dynamodb.query(queryParams).promise();

        promise
        .then(result => {
            resolve(utils.createResponse({
                "statusCode": 200,
                "headers": corsHeaders,
                "body": result
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
    });
    return promise;
}
