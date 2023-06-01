import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";
import { GovernanceToken } from "../typechain-types";
import * as fs from "fs";
import { deploymentsFile } from "../helper-config";

export async function deployGovernanceToken() {
  const governanceTokenFactory: ContractFactory =
    await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await governanceTokenFactory.deploy();
  await governanceToken.deployed();

  console.log("Governance Token deployed to:", governanceToken.address);
  fs.readFile(deploymentsFile, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return;
    }
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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployGovernanceToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
