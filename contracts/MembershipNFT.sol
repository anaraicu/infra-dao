// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";

contract MembershipNFT is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    ERC1155BurnableUpgradeable
{
    string public name;
    string public symbol;
    bool public reinitialized;
    uint256 public totalSupply;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _uri,
        uint256 _initialSupply
    ) public initializer {
        __ERC1155_init(_uri);
        _mint(tx.origin, 0, _initialSupply, "");
        name = "MembershipNFT";
        symbol = "MEM";
        reinitialized = false;
        _transferOwnership(tx.origin);
        totalSupply = _initialSupply;
    }

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
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
        totalSupply += amount;
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public onlyOwner {
        _mintBatch(to, ids, amounts, data);
        uint256 amountsLength = amounts.length;
        for (uint256 i = 0; i < amountsLength; i++) {
            totalSupply += amounts[i];
        }
    }

    function burn(address account, uint256 id, uint256 amount) public override {
        require(
            msg.sender == account || msg.sender == owner(),
            "only owner can burn"
        );
        require(
            balanceOf(account, id) > 0,
            "MembershipNFT::burn: balance is 0"
        );
        require(totalSupply > 0, "total supply is 0");
        totalSupply -= amount;
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
        require(
            balanceOf(account, ids[0]) > 0,
            "MembershipNFT::burnBatch: balance is 0"
        );
        require(totalSupply > 0, "total supply is 0");
        uint256 amountsLength = amounts.length;
        for (uint256 i = 0; i < amountsLength; i++) {
            totalSupply -= amounts[i];
        }
        _burnBatch(account, ids, amounts);
    }
}
