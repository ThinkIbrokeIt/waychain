// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { WIFRGantletRewards } from "src/wifr-gauntlet/WIFRGantletRewards.sol";
import { WIFRCertificationBadge } from "src/wifr-gauntlet/WIFRCertificationBadge.sol";

contract DeployWIFRGantlet {
    event Deployed(address indexed rewards, address indexed badge);
    
    function run() external {
        WIFRGantletRewards rewards = new WIFRGantletRewards();
        WIFRCertificationBadge badge = new WIFRCertificationBadge();
        
        emit Deployed(address(rewards), address(badge));
    }
}