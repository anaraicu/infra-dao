import { ethers, upgrades } from "hardhat";
import { Contract, Signer } from "ethers";
import { expect } from "chai";
import { solidity } from "ethereum-waffle";

import { MembershipNFT, MembershipNFT__factory } from "../typechain-types";
import { toUtf8Bytes } from "ethers/lib/utils";

const chai = require("chai");
chai.use(solidity);
const hre = require("hardhat");

describe("MembershipNFTUnitTests", function () {
  let membershipNFT: MembershipNFT;
  let owner: Signer;
  let address1: Signer;

  const initialSupply = 100;

  beforeEach(async function () {
    [owner, address1] = await ethers.getSigners();

    const uri =
      "https://bafybeihul6zsmbzyrgmjth3ynkmchepyvyhcwecn2yxc57ppqgpvr35zsq.ipfs.dweb.link/0.json";
    const membershipNFTFactory = (await ethers.getContractFactory(
      "MembershipNFT",
      owner
    )) as MembershipNFT__factory;
    membershipNFT = (await upgrades.deployProxy(
      membershipNFTFactory,
      [uri, initialSupply],
      { initializer: "initialize" }
    )) as MembershipNFT;
    await membershipNFT.deployed();
  });

  it("should have correct name, symbol, and URI", async function () {
    expect(await membershipNFT.name()).to.equal("MembershipNFT");
    expect(await membershipNFT.symbol()).to.equal("MEM");
    expect(await membershipNFT["uri()"]()).to.equal(
      "https://bafybeihul6zsmbzyrgmjth3ynkmchepyvyhcwecn2yxc57ppqgpvr35zsq.ipfs.dweb.link/0.json"
    );
  });

  it("should allow owner to set the token URI", async function () {
    const newURI = "https://example.com/new/0.json";
    await membershipNFT.connect(owner).setURI(newURI);
    expect(await membershipNFT["uri()"]()).to.equal(
      "https://example.com/new/0.json"
    );
  });

  it("should allow owner to mint tokens", async function () {
    const account = await address1.getAddress();
    const id = 0;
    const amount = 10;
    await membershipNFT
      .connect(owner)
      .mint(account, id, amount, toUtf8Bytes(""));
    expect(await membershipNFT.balanceOf(account, id)).to.equal(amount);
  });

  it("should allow owner to burn tokens", async function () {
    const account = await address1.getAddress();
    const id = 0;
    const amount = 10;
    await membershipNFT
      .connect(owner)
      .mint(account, id, amount, toUtf8Bytes(""));
    expect(await membershipNFT.balanceOf(account, id)).to.equal(amount);
    await membershipNFT.connect(owner).burn(account, id, amount);
    expect(await membershipNFT.balanceOf(account, id)).to.equal(0);
  });

  it("should allow owner to mint tokens in batch", async function () {
    const account = await address1.getAddress();
    await membershipNFT
      .connect(owner)
      .mintBatch(account, [0], [5], toUtf8Bytes(""));
    expect(await membershipNFT.balanceOf(account, 0)).to.equal(5);

    await membershipNFT
      .connect(owner)
      .mintBatch(account, [0], [10], toUtf8Bytes(""));
    expect(await membershipNFT.balanceOf(account, 0)).to.equal(15);

    await expect(
      membershipNFT.connect(owner).burnBatch(account, [2], [10])
    ).to.be.revertedWith("ERC1155: burn amount exceeds balance");
  });
});
