import { ethers } from "hardhat";
import fs from "fs";
import { deploymentsFile } from "../helper-config";
import { DAOFactory, GovernanceToken, MembershipNFT } from "../typechain-types";
import { toUtf8Bytes } from "ethers/lib/utils";

export async function addFirstMember(daoId: number) {
  const [deployer, member] = await ethers.getSigners();
  const memberAddress = await member.getAddress();
  // const memberAddress = Buffer.from(process.env.METAMASK_ADDRESS, 'base64').toString('ascii');

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const daoFactory = (await ethers.getContractAt(
    "DAOFactory",
    data.daoFactory
  )) as DAOFactory;
  const count = (await daoFactory.getDAOCount()).toNumber();

  const membershipNFT = (await ethers.getContractAt(
    "MembershipNFT",
    data[daoId]["membershipNFT"]
  )) as MembershipNFT;
  const mintTx = await membershipNFT
    .connect(deployer)
    .mint(memberAddress, 0, 1, toUtf8Bytes(""));
  await mintTx.wait(1);
  console.log("Minted membership NFT for " + memberAddress);

  const governanceToken = (await ethers.getContractAt(
    "GovernanceToken",
    data[daoId]["governanceToken"]
  )) as GovernanceToken;

  console.log("Owner: " + (await governanceToken.owner()));
  const mintTx2 = await governanceToken
    .connect(deployer)
    .mint(memberAddress, 1);
  await mintTx2.wait(1);

  console.log("Minted governance token for " + memberAddress);
}

addFirstMember(1)
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
