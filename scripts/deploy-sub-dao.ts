import { ethers } from "hardhat";
import { Box } from "../typechain-types";
import * as fs from "fs";
import { deploymentsFile } from "../helper-config";

export async function deploySubDao(subDAOName: string) {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const box = (await ethers.getContractAt("Box", data.box)) as Box;
  const tx = await box.deploySubDAO(
    ethers.utils.formatBytes32String(subDAOName)
  );
  const receipt = await tx.wait();

  console.log(receipt.events![0].args!);

  const subDAOAddress = receipt.events![0].args![1];
  console.log(`SubDAO deployed at ${subDAOAddress}`);

  switch (subDAOName) {
    case "simple":
      data.simpleClone = subDAOAddress;
      break;
    case "tokenBased":
      data.tokenBasedClone = subDAOAddress;
      break;
    case "quadratic":
      data.quadraticClone = subDAOAddress;
      break;
    case "multiSig":
      data.multiSigClone = subDAOAddress;
      break;
  }

  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
  console.log("Updated deployments.json file successfully.");
}

deploySubDao("simple").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
