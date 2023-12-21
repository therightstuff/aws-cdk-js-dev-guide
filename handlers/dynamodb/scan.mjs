import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { createResponse } from '/opt/nodejs/sample-layer/utils.mjs';

const dynamodb = DynamoDBDocument.from(new DynamoDB({}));

const TABLE_NAME = process.env.TABLE_NAME;

let corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
    'Access-Control-Allow-Credentials': true,
};

export const handler = async (event) => {
    return new Promise(async (resolve) => {
        try {
            // scan the table for unexpired results
            const data = await dynamodb.scan({
                TableName: TABLE_NAME
            });
            resolve(createResponse({
                "statusCode": 200,
                "headers": corsHeaders,
                "body": data.Items
            }));
        } catch (err) {
            console.error(err);
            resolve(createResponse({
                "statusCode": 500,
                "headers": corsHeaders,
                "body": {
                    "success": false,
                    "reason": "an unexpected error occurred",
                    "error": err
                }
            }));
        }
    });
}
