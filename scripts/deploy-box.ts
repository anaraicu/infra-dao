import { ethers, upgrades } from "hardhat";
import { Box } from "../typechain-types";
import * as fs from "fs";
import { deploymentsFile } from "../helper-config";

export async function deployBox() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const boxFactory = await ethers.getContractFactory("Box");
  const box = (await boxFactory.deploy()) as Box;

  await box.deployed();
  console.log("Box deployed to:", box.address);

  data.box = box.address;
  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
  console.log("Updated deployments.json file successfully.");
}

deployBox().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
