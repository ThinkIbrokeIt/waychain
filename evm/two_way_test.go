package evm

import (
	"bytes"
	"math/big"
	"testing"
)

// TestTwoWayDeposit tests basic deposit + getVault flow
func TestTwoWayDeposit(t *testing.T) {
	state := NewStateDB()
	addr := PrecompileAddrHex(0x18)
	acc := state.GetOrCreateAccount(addr)

	// Use the same identifier for collateral setup and deposit
	collateralID := "USD"

	// Set up collateral params
	acc.Storage[paramKey(collateralID+":minCRatio")] = writeSlot(big.NewInt(13000))
	acc.Storage[paramKey(collateralID+":liqRatio")] = writeSlot(big.NewInt(12000))

	vaultID := make([]byte, 32)
	copy(vaultID, []byte("test-vault-001"))

	// The collateral address in the deposit must match the param key
	collateralAddr := []byte(collateralID)
	// Pad to 20 bytes for address format
	collateralAddr20 := make([]byte, 20)
	copy(collateralAddr20, collateralAddr)

	depositAmount := new(big.Int).Mul(big.NewInt(1000), big.NewInt(1e18))

	depInput := make([]byte, 4+32+20+32)
	copy(depInput[0:4], []byte{0xFB, 0xB3, 0x50, 0x30})
	copy(depInput[4:36], vaultID)
	copy(depInput[36:56], collateralAddr20)
	depositAmount.FillBytes(depInput[56:88])

	_, err := twoWayVaultPrecompile(depInput, "0xUser", state, 100)
	if err != nil {
		t.Fatalf("Deposit failed: %v", err)
	}

	// Verify: getVault
	getInput := make([]byte, 4+32)
	copy(getInput[0:4], []byte{0x9E, 0xB2, 0x9E, 0xF0})
	copy(getInput[4:36], vaultID)

	out, err := twoWayVaultPrecompile(getInput, "0xUser", state, 0)
	if err != nil {
		t.Fatalf("GetVault failed: %v", err)
	}

	collateral := readBigInt(readSlot(out, 0))
	debt := readBigInt(readSlot(out, 32))

	if collateral.Cmp(depositAmount) != 0 {
		t.Fatalf("Expected collateral %s, got %s", depositAmount.String(), collateral.String())
	}
	if debt.Cmp(big.NewInt(0)) != 0 {
		t.Fatalf("Expected debt 0, got %s", debt.String())
	}
}

// TestTwoWayMint tests minting 2WAY against deposited collateral
func TestTwoWayMint(t *testing.T) {
	state := NewStateDB()
	addr := PrecompileAddrHex(0x18)
	acc := state.GetOrCreateAccount(addr)

	collateralID := "USD"
	acc.Storage[paramKey(collateralID+":minCRatio")] = writeSlot(big.NewInt(13000))
	acc.Storage[paramKey(collateralID+":liqRatio")] = writeSlot(big.NewInt(12000))

	vaultID := bytes.Repeat([]byte{0x01}, 32)
	collAddr := make([]byte, 20)
	copy(collAddr, collateralID)

	// Deposit 1000 USD
	depAmt := new(big.Int).Mul(big.NewInt(1000), big.NewInt(1e18))
	depInput := make([]byte, 4+32+20+32)
	depInput[0], depInput[1], depInput[2], depInput[3] = 0xFB, 0xB3, 0x50, 0x30
	copy(depInput[4:36], vaultID)
	copy(depInput[36:56], collAddr)
	depAmt.FillBytes(depInput[56:88])

	_, err := twoWayVaultPrecompile(depInput, "0xUser", state, 1)
	if err != nil {
		t.Fatalf("Deposit failed: %v", err)
	}

	// Mint 500 2WAY (166% C-Ratio)
	mintAmt := new(big.Int).Mul(big.NewInt(500), big.NewInt(1e18))
	mintInput := make([]byte, 4+32+32)
	mintInput[0], mintInput[1], mintInput[2], mintInput[3] = 0xD1, 0x85, 0xE0, 0x7F
	copy(mintInput[4:36], vaultID)
	mintAmt.FillBytes(mintInput[36:68])

	_, err = twoWayVaultPrecompile(mintInput, "0xUser", state, 2)
	if err != nil {
		t.Fatalf("Mint should succeed: %v", err)
	}

	getInput := make([]byte, 4+32)
	getInput[0], getInput[1], getInput[2], getInput[3] = 0x9E, 0xB2, 0x9E, 0xF0
	copy(getInput[4:36], vaultID)
	out, _ := twoWayVaultPrecompile(getInput, "0xUser", state, 0)
	debt := readBigInt(readSlot(out, 32))
	if debt.Cmp(big.NewInt(0)) <= 0 {
		t.Fatalf("Expected debt > 0 after mint")
	}
	t.Logf("✅ Mint: debt = %s", debt.String())
}

// TestTwoWayOverMintFails tests that minting above C-Ratio fails
func TestTwoWayOverMintFails(t *testing.T) {
	state := NewStateDB()
	addr := PrecompileAddrHex(0x18)
	acc := state.GetOrCreateAccount(addr)

	collateralID := "USD"
	acc.Storage[paramKey(collateralID+":minCRatio")] = writeSlot(big.NewInt(13000))

	vaultID := bytes.Repeat([]byte{0x02}, 32)
	collAddr := make([]byte, 20)
	copy(collAddr, collateralID)

	// Deposit 1000 USD
	depAmt := new(big.Int).Mul(big.NewInt(1000), big.NewInt(1e18))
	depInput := make([]byte, 4+32+20+32)
	depInput[0], depInput[1], depInput[2], depInput[3] = 0xFB, 0xB3, 0x50, 0x30
	copy(depInput[4:36], vaultID)
	copy(depInput[36:56], collAddr)
	depAmt.FillBytes(depInput[56:88])
	twoWayVaultPrecompile(depInput, "0xUser", state, 1)

	overMint := new(big.Int).Mul(big.NewInt(2000), big.NewInt(1e18))
	mintInput := make([]byte, 4+32+32)
	mintInput[0], mintInput[1], mintInput[2], mintInput[3] = 0xD1, 0x85, 0xE0, 0x7F
	copy(mintInput[4:36], vaultID)
	overMint.FillBytes(mintInput[36:68])

	_, err := twoWayVaultPrecompile(mintInput, "0xUser", state, 2)
	if err == nil {
		t.Fatal("Over-mint should fail but succeeded")
	}
	t.Logf("✅ Over-mint correctly rejected: %v", err)
}

// TestTwoWayBurn tests burning 2WAY to reduce debt
func TestTwoWayBurn(t *testing.T) {
	state := NewStateDB()
	addr := PrecompileAddrHex(0x18)
	acc := state.GetOrCreateAccount(addr)

	collateralID := "USD"
	acc.Storage[paramKey(collateralID+":minCRatio")] = writeSlot(big.NewInt(13000))

	vaultID := bytes.Repeat([]byte{0x03}, 32)
	collAddr := make([]byte, 20)
	copy(collAddr, collateralID)

	// Deposit 500 USD + Mint 300 2WAY
	depAmt := new(big.Int).Mul(big.NewInt(500), big.NewInt(1e18))
	depInput := make([]byte, 4+32+20+32)
	depInput[0], depInput[1], depInput[2], depInput[3] = 0xFB, 0xB3, 0x50, 0x30
	copy(depInput[4:36], vaultID)
	copy(depInput[36:56], collAddr)
	depAmt.FillBytes(depInput[56:88])
	twoWayVaultPrecompile(depInput, "0xUser", state, 1)

	mintAmt := new(big.Int).Mul(big.NewInt(300), big.NewInt(1e18))
	mintInput := make([]byte, 4+32+32)
	mintInput[0], mintInput[1], mintInput[2], mintInput[3] = 0xD1, 0x85, 0xE0, 0x7F
	copy(mintInput[4:36], vaultID)
	mintAmt.FillBytes(mintInput[36:68])
	twoWayVaultPrecompile(mintInput, "0xUser", state, 2)

	// Burn 100 2WAY
	burnAmt := new(big.Int).Mul(big.NewInt(100), big.NewInt(1e18))
	burnInput := make([]byte, 4+32+32)
	burnInput[0], burnInput[1], burnInput[2], burnInput[3] = 0x0E, 0x0C, 0x59, 0xBE
	copy(burnInput[4:36], vaultID)
	burnAmt.FillBytes(burnInput[36:68])
	_, err := twoWayVaultPrecompile(burnInput, "0xUser", state, 3)
	if err != nil {
		t.Fatalf("Burn failed: %v", err)
	}

	// Verify remaining debt = 200
	getInput := make([]byte, 4+32)
	getInput[0], getInput[1], getInput[2], getInput[3] = 0x9E, 0xB2, 0x9E, 0xF0
	copy(getInput[4:36], vaultID)
	out, _ := twoWayVaultPrecompile(getInput, "0xUser", state, 0)
	remainingDebt := readBigInt(readSlot(out, 32))
	expected := new(big.Int).Mul(big.NewInt(200), big.NewInt(1e18))
	if remainingDebt.Cmp(expected) != 0 {
		t.Fatalf("Expected debt %s, got %s", expected.String(), remainingDebt.String())
	}
	t.Logf("✅ Burn: remaining debt = %s", remainingDebt.String())
}
