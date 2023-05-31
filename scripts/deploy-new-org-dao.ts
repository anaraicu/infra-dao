import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import fs from "fs";
import { deploymentsFile } from "../helper-config";
import { DAOFactory, MembershipNFT } from "../typechain-types";
import web3 from "web3";

export async function deployNewOrgDao() {
  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const daoFactory = (await ethers.getContractAt(
    "DAOFactory",
    data.daoFactory
  )) as DAOFactory;

  const tx = await daoFactory.deployDAO(
    "https://bafkreigguxuphkzs7qis7y2oxn3wzwq7w3ipfoojryy52he4rq2xhy6bk4.ipfs.nftstorage.link/",
    10,
    20,
    4
  );
  const receipt = await tx.wait();
  const res = receipt.events!;

  const count = (await daoFactory.getDAOCount()) as BigNumber;

  console.log("DAO Count: ", count.toNumber());
  data["orgDao" + count.toNumber()] = {};
  for (let i = 0; i < res.length - 1; i++) {
    const contractType = web3.utils.hexToAscii(res[i].args!.contractType);
    const type = contractType.replace(/\u0000+$/, "");
    data["orgDao" + count.toNumber()][type] = res[i]!.args!.deployedAddress;
    console.log(
      `New OrgDao ${type} deployed to:`,
      res[i]!.args!.deployedAddress
    );
  }
  console.log(
    "https://bafkreigguxuphkzs7qis7y2oxn3wzwq7w3ipfoojryy52he4rq2xhy6bk4.ipfs.nftstorage.link/"
  );
  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
  const membershipNFT = (await ethers.getContractAt(
    "MembershipNFT",
    data["orgDao1"]["membershipNFT"]
  )) as MembershipNFT;
  console.log("Membership NFT deployed to:", membershipNFT.address);
  console.log(
    "Remaining Supply: ",
    await membershipNFT.setURI(
      "https://bafkreigguxuphkzs7qis7y2oxn3wzwq7w3ipfoojryy52he4rq2xhy6bk4.ipfs.nftstorage.link/"
    )
  );

  console.log();
}

deployNewOrgDao().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
