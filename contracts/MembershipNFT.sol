// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "hardhat/console.sol";

contract MembershipNFT is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    ERC1155BurnableUpgradeable
{
    string public name;
    string public symbol;
    bool public reinitialized;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _uri,
        uint256 _initialSupply
    ) public initializer {
        __ERC1155_init(_uri);
        __Ownable_init();
        _mint(msg.sender, 0, _initialSupply, "");
        name = "MembershipNFT";
        symbol = "MEM";
        reinitialized = false;
    }

    function reinitialize(
        string memory _uri,
        uint256 _initialSupply
    ) public onlyOwner {
        require(
            !reinitialized,
            "MemershipNFT::reinitialize:already reinitialized"
        );
        reinitialized = true;
        __ERC1155_init(_uri);
        _mint(msg.sender, 0, _initialSupply, "");
    }

    function setURI(string memory newuri) public onlyOwner {
        console.log("setURI");
        console.log(newuri);
        _setURI(newuri);
        console.log("setURI done");
        console.log(super.uri(0));
    }

    function getURI() public view returns (string memory) {
        return super.uri(0);
    }

    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public onlyOwner {
        _mint(account, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public onlyOwner {
        _mintBatch(to, ids, amounts, data);
    }

    function burn(address account, uint256 id, uint256 amount) public override {
        require(
            msg.sender == account || msg.sender == owner(),
            "only owner can burn"
        );
        _burn(account, id, amount);
    }

    function burnBatch(
        address account,
        uint256[] memory ids,
        uint256[] memory amounts
    ) public override {
        require(
            msg.sender == account || msg.sender == owner(),
            "only owner can burn"
        );
        _burnBatch(account, ids, amounts);
    }
}
