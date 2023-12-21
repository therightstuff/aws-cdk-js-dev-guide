export const createResponse = ({ statusCode, body, headers, isBase64Encoded }) => {
    let result = {
        "isBase64Encoded": (isBase64Encoded == true) || false,
        "statusCode": statusCode || 200,
        "headers": headers || {},
        "body": JSON.stringify(body || {})
    }
    return result;
};
