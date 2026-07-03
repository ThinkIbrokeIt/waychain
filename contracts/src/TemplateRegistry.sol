// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TemplateRegistry
 * @notice Central registry for all audited WayChain contract templates.
 *         Contract classification:
 *         - Class A: Safe (anyone can deploy)
 *         - Class B: Managed (Dox_Dev Level 2+ required)
 *         - Class C: Governed (governance approval required)
 *
 *         Deploying from a template is cheaper and safer than
 *         deploying raw bytecode because the template is pre-audited.
 */
contract TemplateRegistry {
    event TemplateRegistered(
        bytes32 indexed templateId,
        string name,
        ContractClass contractClass,
        address templateAddress,
        address indexed registrar
    );
    event TemplateDeployed(
        bytes32 indexed templateId,
        address indexed instance,
        address indexed deployer
    );
    event RegistrarAdded(address indexed registrar);
    event RegistrarRemoved(address indexed registrar);

    enum ContractClass { A, B, C }

    struct Template {
        string name;
        string description;
        ContractClass contractClass;
        address implementation; // Reference implementation address (optional, for bytecode)
        bytes bytecodeHash;    // keccak256 of deployed bytecode
        bool active;
        uint256 registeredAt;
        address registrar;
        uint256 deployCount;
    }

    bytes32[] public templateIds;
    mapping(bytes32 => Template) public templates;
    mapping(address => bool) public registrars;    // Can register new templates

    /// @notice Minimum Dox_Dev level required to deploy Class B contracts
    uint8 public constant CLASS_B_MIN_LEVEL = 2;
    /// @notice Minimum Dox_Dev level required to deploy Class C contracts
    uint8 public constant CLASS_C_MIN_LEVEL = 3;

    // Reference to Dox_Dev badge contract (set at construction)
    address public immutable doxDevBadge;
    uint256 public totalDeployments;

    modifier onlyRegistrar() {
        require(registrars[msg.sender], "Not a registrar");
        _;
    }

    constructor(address _doxDevBadge, address[] memory initialRegistrars) {
        require(_doxDevBadge != address(0), "Invalid badge address");
        require(initialRegistrars.length > 0, "Need at least 1 registrar");
        doxDevBadge = _doxDevBadge;

        for (uint256 i = 0; i < initialRegistrars.length; i++) {
            require(initialRegistrars[i] != address(0), "Invalid registrar");
            registrars[initialRegistrars[i]] = true;
            emit RegistrarAdded(initialRegistrars[i]);
        }
    }

    /**
     * @notice Register a new template
     * @param name Human-readable name
     * @param description Description of the template
     * @param contractClass A, B, or C
     * @param bytecodeHash keccak256 of the deployed bytecode
     */
    function registerTemplate(
        string calldata name,
        string calldata description,
        ContractClass contractClass,
        bytes calldata bytecodeHash
    ) external onlyRegistrar returns (bytes32) {
        bytes32 templateId = keccak256(bytes(name));
        require(!templates[templateId].active, "Template already exists");
        require(bytes(name).length > 0, "Empty name");
        require(bytecodeHash.length == 32, "Invalid bytecode hash");

        templates[templateId] = Template({
            name: name,
            description: description,
            contractClass: contractClass,
            implementation: address(0),
            bytecodeHash: bytecodeHash,
            active: true,
            registeredAt: block.timestamp,
            registrar: msg.sender,
            deployCount: 0
        });

        templateIds.push(templateId);

        emit TemplateRegistered(templateId, name, contractClass, address(0), msg.sender);
        return templateId;
    }

    /**
     * @notice Check if deployer meets the class requirements
     */
    function _checkDeployer(bytes32 templateId) internal view {
        Template storage tmpl = templates[templateId];
        require(tmpl.active, "Template not found");

        if (tmpl.contractClass == ContractClass.A) {
            return; // Anyone can deploy Class A
        }

        // For Class B and C, check Dox_Dev level
        (bool success, bytes memory data) = doxDevBadge.staticcall(
            abi.encodeWithSignature("getLevel(address)", msg.sender)
        );
        require(success, "Badge check failed");

        uint8 level = abi.decode(data, (uint8));

        uint8 minLevel = tmpl.contractClass == ContractClass.B ? CLASS_B_MIN_LEVEL : CLASS_C_MIN_LEVEL;
        require(level >= minLevel, "Insufficient Dox_Dev level");
    }

    /**
     * @notice Record a template deployment
     * @param templateId The template being deployed
     * @param instance The address of the deployed contract
     */
    function recordDeployment(bytes32 templateId, address instance) external {
        _checkDeployer(templateId);

        Template storage tmpl = templates[templateId];
        tmpl.deployCount++;
        totalDeployments++;

        emit TemplateDeployed(templateId, instance, msg.sender);
    }

    /**
     * @notice Get template info
     */
    function getTemplate(bytes32 templateId) external view returns (Template memory) {
        return templates[templateId];
    }

    /**
     * @notice Get all registered template IDs
     */
    function getTemplateIds() external view returns (bytes32[] memory) {
        return templateIds;
    }

    /**
     * @notice Add a registrar (governance-controlled in production)
     */
    function addRegistrar(address registrar) external onlyRegistrar {
        require(!registrars[registrar], "Already a registrar");
        registrars[registrar] = true;
        emit RegistrarAdded(registrar);
    }
}