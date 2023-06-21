import { ethers } from "hardhat";
import {
  Box,
  TokenBasedGovernance,
  MultiSigGovernance,
  QuadraticGovernance,
  WeightedGovernance,
} from "../typechain-types";
import * as fs from "fs";
import { deploymentsFile } from "../helper-config";

export async function deployGovernanceContracts() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const boxFactory = await ethers.getContractFactory("Box");
  const box = (await boxFactory.deploy()) as Box;

  await box.deployed();
  console.log("Box deployed to:", box.address);

  const tokenBasedGovernanceFactory = await ethers.getContractFactory(
    "TokenBasedGovernance"
  );
  const tokenBasedGovernance =
    (await tokenBasedGovernanceFactory.deploy()) as TokenBasedGovernance;
  await tokenBasedGovernance.deployed();
  console.log(
    "TokenBasedGovernance deployed to:",
    tokenBasedGovernance.address
  );
  data.tokenBased = tokenBasedGovernance.address;

  const weightedGovernanceFactory = await ethers.getContractFactory(
    "WeightedGovernance"
  );
  const weightedGovernance =
    (await weightedGovernanceFactory.deploy()) as WeightedGovernance;
  await weightedGovernance.deployed();
  console.log("WeightedGovernance deployed to:", weightedGovernance.address);
  data.weighted = weightedGovernance.address;

  const quadraticGovernanceFactory = await ethers.getContractFactory(
    "QuadraticGovernance"
  );
  const quadraticGovernance =
    (await quadraticGovernanceFactory.deploy()) as QuadraticGovernance;
  await quadraticGovernance.deployed();
  console.log("QuadraticGovernance deployed to:", quadraticGovernance.address);
  data.quadratic = quadraticGovernance.address;

  const multiSigGovernanceFactory = await ethers.getContractFactory(
    "MultiSigGovernance"
  );
  const multiSigGovernance =
    (await multiSigGovernanceFactory.deploy()) as MultiSigGovernance;
  await multiSigGovernance.deployed();
  console.log("MultiSigGovernance deployed to:", multiSigGovernance.address);
  data.multiSig = multiSigGovernance.address;

  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
}

deployGovernanceContracts().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
