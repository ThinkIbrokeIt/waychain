// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal ERC20 implementation — no OpenZeppelin dependency
abstract contract ERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    string private _name;
    string private _symbol;
    uint8 public constant decimals = 18;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view returns (string memory) { return _name; }
    function symbol() public view returns (string memory) { return _symbol; }
    function totalSupply() public view returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view returns (uint256) { return _balances[account]; }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function transfer(address to, uint256 value) public returns (bool) {
        _update(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= value, "Insufficient allowance");
        _allowances[from][msg.sender] = currentAllowance - value;
        _update(from, to, value);
        return true;
    }

    function _mint(address to, uint256 value) internal {
        _totalSupply += value;
        _balances[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        _balances[from] -= value;
        _totalSupply -= value;
        emit Transfer(from, address(0), value);
    }

    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            _mint(to, value);
        } else {
            _balances[from] -= value;
            if (to == address(0)) {
                _totalSupply -= value;
            } else {
                _balances[to] += value;
            }
            emit Transfer(from, to, value);
        }
    }
}

/**
 * @title BIJO
 * @notice Binary Journal's independent token.
 *         ERC-20 on WayChain with transfer restrictions at launch.
 *
 *         No mint function. No admin keys. Capped supply at deployment.
 *         Once transfers are enabled, they cannot be disabled again.
 */
contract BIJO is ERC20 {
    event TransfersEnabled(uint256 indexed blockNumber);

    bool public transfersEnabled;
    address public immutable governance;
    address public immutable storageEndowment;
    address public immutable airdropDistributor;
    address public immutable founderVesting;
    address public immutable liquidityPool;
    address public immutable ecosystemReserve;

    uint256 public constant SUPPLY = 369_000_000 * 10 ** 18; // 369M

    constructor(
        address _governance,
        address _storageEndowment,
        address _airdropDistributor,
        address _founderVesting,
        address _liquidityPool,
        address _ecosystemReserve
    ) ERC20("Binary Journal", "BIJO") {
        require(_governance != address(0), "Invalid governance");
        require(_storageEndowment != address(0), "Invalid storage endowment");
        require(_airdropDistributor != address(0), "Invalid airdrop");
        require(_founderVesting != address(0), "Invalid vesting");
        require(_liquidityPool != address(0), "Invalid liquidity");
        require(_ecosystemReserve != address(0), "Invalid reserve");

        governance = _governance;
        storageEndowment = _storageEndowment;
        airdropDistributor = _airdropDistributor;
        founderVesting = _founderVesting;
        liquidityPool = _liquidityPool;
        ecosystemReserve = _ecosystemReserve;

        // Mint all tokens at deployment
        _mint(_storageEndowment, SUPPLY * 70 / 100);       // 70% — Eternal archive
        _mint(_airdropDistributor, SUPPLY * 10 / 100);      // 10% — Airdrop
        _mint(_founderVesting, SUPPLY * 6 / 100);           // 6%  — Founder vesting
        _mint(_liquidityPool, SUPPLY * 5 / 1000);           // 0.5% — Liquidity
        _mint(_ecosystemReserve, SUPPLY - totalSupply());   // Remainder ~13.5%
    }

    /**
     * @notice Enable transfers (one-way door). Called by governance
     *         after verification period is complete.
     */
    function enableTransfers() external {
        require(msg.sender == governance, "Only governance");
        require(!transfersEnabled, "Already enabled");
        transfersEnabled = true;
        emit TransfersEnabled(block.number);
    }

    /**
     * @notice Override _update to enforce transfer restrictions
     */
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(transfersEnabled, "Transfers not yet enabled");
        }
        super._update(from, to, value);
    }
}