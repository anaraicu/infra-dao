import { ethers, upgrades } from "hardhat";
import {
  Box,
  Governance__factory,
  MultiSigGovernance__factory,
  QuadraticGovernance__factory,
  TokenBasedGovernance__factory,
} from "../typechain-types";
import * as fs from "fs";
import { deploymentsFile } from "../helper-config";

export async function deployBox() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const boxFactory = await ethers.getContractFactory("Box");
  const box = (await upgrades.deployProxy(boxFactory, [data.timeLock], {
    initializer: "initialize",
  })) as Box;

  await box.deployed();
  console.log("Box deployed to:", box.address);

  data.box = box.address;

  console.log("Deploying sub-governance implementations...");
  const implementations = [
    { name: "simple", factory: Governance__factory },
    { name: "tokenBased", factory: TokenBasedGovernance__factory },
    { name: "quadratic", factory: QuadraticGovernance__factory },
    { name: "multiSig", factory: MultiSigGovernance__factory },
  ];
  for (const { name, factory } of implementations) {
    const governanceFactory = new factory(deployer);
    const governance = await governanceFactory.deploy();
    console.log(`${name} deployed at ${governance.address}`);
    const formattedName = ethers.utils.formatBytes32String(name);
    const tx = await box.registerSubDAO(formattedName, governance.address);
    await tx.wait();
    console.log(`${name} registered in Box at ${governance.address}`);
    switch (name) {
      case "simple":
        data.simple = governance.address;
        break;
      case "tokenBased":
        data.tokenBased = governance.address;
        break;
      case "quadratic":
        data.quadratic = governance.address;
        break;
      case "multiSig":
        data.multiSig = governance.address;
        break;
    }
  }
  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
  console.log("Updated deployments.json file successfully.");
}

deployBox().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
