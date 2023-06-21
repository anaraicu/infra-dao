import { ethers } from "hardhat";
import fs from "fs";
import {
  BASE_URI,
  deploymentsFile,
  QUORUM_PERCENTAGE,
  VOTING_PERIOD,
} from "../helper-config";
import { Box, DAOFactory, MembershipNFT } from "../typechain-types";
import web3 from "web3";

export async function deployOrgDao(
  name: string,
  description: string,
  nftUri: string,
  initialSupply: number,
  votingPeriod: number,
  quorumPercentage: number
) {
  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const daoFactory = (await ethers.getContractAt(
    "DAOFactory",
    data.daoFactory
  )) as DAOFactory;

  const tx = await daoFactory.deployDAO(
    ethers.utils.formatBytes32String(name),
    description,
    nftUri,
    initialSupply,
    votingPeriod,
    quorumPercentage
  );
  const receipt = await tx.wait();
  const res = receipt.events!;

  const count = (await daoFactory.getDAOCount()).toNumber();

  console.log("DAO Count: ", count);
  data[count] = {};
  for (let i = 0; i < res.length - 1; i++) {
    if (res[i].event !== "ClonedContractDeployed") continue;
    const contractType = web3.utils.hexToAscii(res[i].args!.contractType);
    const type = contractType.replace(/\u0000+$/, "");
    data[count][type] = res[i]!.args!.deployedAddress;
    console.log(
      `New OrgDao ${type} deployed to:`,
      res[i]!.args!.deployedAddress
    );
  }
  data[count].subDAO = {};

  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));

  const membershipNFT = (await ethers.getContractAt(
    "MembershipNFT",
    data[count]["membershipNFT"]
  )) as MembershipNFT;
  console.log("Membership NFT deployed to:", membershipNFT.address);
  console.log(
    "Set new URI with gas: ",
    (
      await membershipNFT.setURI(
        "https://bafkreigguxuphkzs7qis7y2oxn3wzwq7w3ipfoojryy52he4rq2xhy6bk4.ipfs.nftstorage.link/"
      )
    ).gasPrice!.toString()
  );

  console.log("New URI: ", await membershipNFT.getURI());

  const box = (await ethers.getContractAt("Box", data[count]["box"])) as Box;
  const registerTx = await box.registerSubDAOImplementations(
    data.tokenBased,
    data.weighted,
    data.quadratic,
    data.multiSig
  );
  await registerTx.wait();
  console.log("SubDAO implementations registered");
}

deployOrgDao(
  "MeshPower DAO",
  "MeshPower aims to offer cost-effective electricity solutions to underserved communities" +
    " lacking energy access, through solar-powered nano-grids and smart metering systems.",
  BASE_URI,
  10,
  VOTING_PERIOD,
  QUORUM_PERCENTAGE
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});