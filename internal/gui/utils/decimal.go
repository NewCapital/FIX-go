package utils

import (
	"github.com/shopspring/decimal"
)

// FIXAmount represents a FIX amount with proper decimal handling
type FIXAmount struct {
	Value decimal.Decimal
}

// NewFIXAmount creates a new FIX amount from string
func NewFIXAmount(amount string) (*FIXAmount, error) {
	d, err := decimal.NewFromString(amount)
	if err != nil {
		return nil, err
	}
	return &FIXAmount{Value: d}, nil
}

// ToSatoshi converts FIX to satoshi (smallest unit)
func (a *FIXAmount) ToSatoshi() int64 {
	satoshi := a.Value.Mul(decimal.NewFromInt(100000000))
	return satoshi.IntPart()
}

// FromSatoshi creates FIXAmount from satoshi
func FromSatoshi(satoshi int64) *FIXAmount {
	d := decimal.NewFromInt(satoshi).Div(decimal.NewFromInt(100000000))
	return &FIXAmount{Value: d}
}

// String returns string representation
func (a *FIXAmount) String() string {
	return a.Value.StringFixed(8)
}
