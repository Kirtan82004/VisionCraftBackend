import fs from "fs";
import path from "path";

 const tempDir = path.join(process.cwd(), "public/temp");

export const createTempFolder = (req, res, next) => {
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log("✅ Folder 'public/temp' created successfully!");
    }
    next();
}
