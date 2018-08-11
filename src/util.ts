import fs from 'fs';
import pify from 'pify';

export const filesInDir = pify(fs.readdir);
export const readFile = pify(fs.readFile);
export const fileInfo = pify(fs.stat);
