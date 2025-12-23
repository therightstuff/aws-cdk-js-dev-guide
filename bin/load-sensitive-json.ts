import dotenv from "dotenv";
import fs from 'node:fs';
dotenv.config();

const getNextPlaceholder = (body: string) => {
  let result = /{{([^}]+)}}/.exec(body);
  return result?.[1];
};

const loadSensitiveJson = (path: string) => {
  let obj = fs.readFileSync(path, 'utf8');
  // while there are more placeholders
  for (let match = getNextPlaceholder(obj); match; match = getNextPlaceholder(obj)) {
    let value = process.env[match] ?? '';
    if (value.length === 0) {
      throw new Error(`Missing environment variable "${match}"`);
    }
    obj = obj.replace(`{{${match}}}`, value);
  }
  return JSON.parse(obj);
};

export default loadSensitiveJson;
