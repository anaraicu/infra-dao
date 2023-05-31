import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";
import { MembershipNFT } from "../typechain-types";
import * as fs from "fs";
import { deploymentsFile } from "../helper-config";

export async function deployMembershipNFT(uri: string, initialSupply: number) {
  const membershipNFTFactory: ContractFactory = await ethers.getContractFactory(
    "MembershipNFT"
  );
  const membershipNFT = await upgrades.deployProxy(
    membershipNFTFactory,
    ["uri", initialSupply],
    { initializer: "initialize" }
  );
  await membershipNFT.deployed();

  console.log("Membership NFT deployed to:", membershipNFT.address);

  // Read the content from the deployments.json file
  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  data.membershipNFT = membershipNFT.address;

  const mem = (await ethers.getContractAt(
    "MembershipNFT",
    data.membershipNFT
  )) as MembershipNFT;
  console.log(mem.address);
  console.log(mem.getURI());

  // Update deployments with new membershipNFT address
  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
  console.log("Updated deployments.json file successfully.");
}

deployMembershipNFT(
  "https://bafkreigguxuphkzs7qis7y2oxn3wzwq7w3ipfoojryy52he4rq2xhy6bk4.ipfs.nftstorage.link/",
  10
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
