import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { createResponse } from '/opt/nodejs/sample-layer/utils.mjs';

const dynamodb = DynamoDBDocument.from(new DynamoDB({}));

const TABLE_NAME = process.env.TABLE_NAME;

let corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
    'Access-Control-Allow-Credentials': true,
};

// eslint-disable-next-line no-unused-vars
export const handler = async (event) => {
    try {
        // scan the table for unexpired results
        const data = await dynamodb.scan({
            TableName: TABLE_NAME
        });
        return createResponse({
            "statusCode": 200,
            "headers": corsHeaders,
            "body": data.Items
        });
    } catch (err) {
        console.error(err);
        return createResponse({
            "statusCode": 500,
            "headers": corsHeaders,
            "body": {
                "success": false,
                "reason": "an unexpected error occurred",
                "error": err
            }
        });
    }
}
