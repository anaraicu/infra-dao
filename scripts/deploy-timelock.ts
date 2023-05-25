import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";
import { TimeLock } from "../typechain-types";
import * as fs from "fs";
import { deploymentsFile, VOTING_DELAY } from "../helper-config";
export async function deployTimeLock(minDelay: number) {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const timeLockFactory: ContractFactory = await ethers.getContractFactory(
    "TimeLock"
  );
  const timeLock = (await upgrades.deployProxy(
    timeLockFactory,
    [minDelay, [], [], deployerAddress],
    { initializer: "initialize" }
  )) as TimeLock;
  await timeLock.deployed();

  console.log("Membership NFT deployed to:", timeLock.address);

  // Read the content from the deployments.json file
  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  data.timeLock = timeLock.address;
  // Update deployments with new membershipNFT address
  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
  console.log("Updated deployments.json file successfully.");
}

deployTimeLock(VOTING_DELAY).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
