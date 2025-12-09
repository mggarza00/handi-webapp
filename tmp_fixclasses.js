const fs = require("fs");
const path = "app/page.tsx";
let text = fs.readFileSync(path, "utf8");
text = text.replace('sm:text-4xl`}``', 'sm:text-4xl`}');
text = text.replace('sm:text-lg`}``', 'sm:text-lg`}');
text = text.replace('hover:bg-[#9bc32f]`}``', 'hover:bg-[#9bc32f`}');
fs.writeFileSync(path, text);
