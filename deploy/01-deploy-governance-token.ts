import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";
import { GovernanceToken } from "../typechain-types";
import * as fs from "fs";

const governanceTokenAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const membershipNFTAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const timeLockAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
// Deploy functions that will run with hardhat
const deployGovernanceToken: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  console.log("Deploying Governance Token... ");
  const { getNamedAccounts, deployments, network } = hre;
  // import accounts from hardhat config right into deploy script
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts(); // always the 0th
  log("Deploying Governance Token... ");

  const governanceTokenFactory: ContractFactory =
    await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await upgrades.deployProxy(
    governanceTokenFactory,
    [],
    { initializer: "initialize" }
  );
  await governanceToken.deployed();
  log("Governance Token deployed to:", governanceToken.address);
  fs.readFile("deployments.json", "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return;
    }

    // Clear the file's content
    const emptyContent = "";

    // Write the new object with the governanceToken field
    const newObject = {
      governanceToken: governanceToken.address,
    };

    // Convert the object to JSON string
    const jsonString = JSON.stringify(newObject, null, 2);

    // Write the new content to the file
    fs.writeFile("deployments.json", jsonString, "utf8", (err) => {
      if (err) {
        console.error("Error writing file:", err);
        return;
      }
      console.log("File has been successfully updated.");
    });
  });
};

export default deployGovernanceToken;
