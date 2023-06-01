import { ethers } from "hardhat";
import { Box, DAOFactory, Governance } from "../typechain-types";
import * as fs from "fs";
import {
  deploymentsFile,
  QUORUM_PERCENTAGE,
  VOTING_PERIOD,
} from "../helper-config";
import web3 from "web3";

export async function deploySubDao(
  subDAOType: string,
  subDAOName: string,
  subDAODescription: string,
  votingPeriod: number,
  quorumPercentage: number
) {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const daoFactory = (await ethers.getContractAt(
    "DAOFactory",
    data.daoFactory
  )) as DAOFactory;
  const count = (await daoFactory.getDAOCount()).toNumber();

  const box = (await ethers.getContractAt("Box", data[count]["box"])) as Box;
  const tx = await box.deploySubDAO(
    ethers.utils.formatBytes32String(subDAOType),
    ethers.utils.formatBytes32String(subDAOName),
    ethers.utils.formatBytes32String(subDAODescription),
    data[count]["governanceToken"],
    data[count]["membershipNFT"],
    100,
    quorumPercentage
  );
  const receipt = await tx.wait();
  const res = receipt.events![receipt.events!.length - 1].args!;

  const subDAOCount = (await box.getSubDAOCount()).toNumber();
  const subDAO = (await box.getSubDAO(subDAOCount - 1)) as Box.SubDAOStruct;

  const subDAOTypeReceipt = res.subDAOId;
  const subDAOAddress = res.subDAOAddress;
  console.log(
    `SubDAO type: ${web3.utils.hexToAscii(
      subDAOTypeReceipt
    )} deployed at: ${subDAOAddress}`
  );
  console.log(
    `SubDAO name: ${web3.utils.hexToAscii((await subDAO.name).toString())}`
  );
  console.log(
    `SubDAO description: ${web3.utils.hexToAscii(
      (await subDAO.description).toString()
    )}`
  );
  console.log(`SubDAO registered address: ${await subDAO.subDAOAddress}`);
  console.log(`SubDAO event address: ${subDAOAddress}`);

  data[count]["subDAO"][subDAOCount] = subDAOAddress;

  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
  console.log("Updated deployments.json file successfully.");

  // Test sub-governance module was initialized correctly
  const governor = (await ethers.getContractAt(
    "Governance",
    subDAOAddress
  )) as Governance;
  const governorToken = await governor.votingPeriod();
  console.log(`Governor voting period: ${governorToken.toString()}`);
}

deploySubDao(
  "simple",
  "eWater",
  "Description",
  VOTING_PERIOD,
  QUORUM_PERCENTAGE
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
