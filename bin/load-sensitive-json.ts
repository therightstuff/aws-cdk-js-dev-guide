import fs from 'fs';
import dotenv from "dotenv";
dotenv.config();

const getNextPlaceholder = (body: string) => {
  let result = body.match(/{{([^}]+)}}/);
  return result && result[1];
};

const loadSensitiveJson = (path: string) => {
  let obj = fs.readFileSync(path, 'utf8');
  // while there are more placeholders
  for (let match = getNextPlaceholder(obj); match; match = getNextPlaceholder(obj)) {
    obj = obj.replace(`{{${match}}}`, process.env[match] || '');
  }
  return JSON.parse(obj);
};

export default loadSensitiveJson;