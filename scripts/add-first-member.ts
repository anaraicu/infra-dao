import { ethers } from "hardhat";
import fs from "fs";
import { deploymentsFile } from "../helper-config";
import { GovernanceToken, MembershipNFT } from "../typechain-types";
import { toUtf8Bytes } from "ethers/lib/utils";

export async function addFirstMember() {
  const [deployer, member] = await ethers.getSigners();
  const memberAddress = await member.getAddress();
  // const memberAddress = Buffer.from(process.env.METAMASK_ADDRESS, 'base64').toString('ascii');

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const membershipNFT = (await ethers.getContractAt(
    "MembershipNFT",
    data.membershipNFT
  )) as MembershipNFT;
  const mintTx = await membershipNFT.mint(memberAddress, 0, 1, toUtf8Bytes(""));
  await mintTx.wait(1);

  const governanceToken = (await ethers.getContractAt(
    "GovernanceToken",
    data.governanceToken
  )) as GovernanceToken;
  const mintTx2 = await governanceToken.mint(memberAddress, 1);
  await mintTx2.wait(1);
  console.log(
    "Minted membership NFT and governance token for " + memberAddress
  );
}

addFirstMember()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
