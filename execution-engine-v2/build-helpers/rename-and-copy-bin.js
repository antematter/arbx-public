const execa = require("execa");
const fs = require("fs");

let extension = "";
if (process.platform === "win32") {
  extension = ".exe";
}

async function main() {
  const rustInfo = (await execa("rustc", ["-vV"])).stdout;
  const targetTripleResult = /host: (\S+)/g.exec(rustInfo);
  const targetTriple = targetTripleResult ? targetTripleResult[1] : "";

  const renameSource = `dist/bin/execution-engine${extension}`;
  const renameDest = `dist/bin/execution-engine-${targetTriple}${extension}`;
  fs.renameSync(renameSource, renameDest);

  const copySource = renameDest;
  const copyDestDir = "../arbx-console/src-tauri/execution-engine/";
  const copyDest = `${copyDestDir}execution-engine-${targetTriple}${extension}`;

  if (!fs.existsSync(copyDestDir)) fs.mkdirSync(copyDestDir);
  fs.copyFileSync(copySource, copyDest);
}

main().catch((e) => {
  throw e;
});
