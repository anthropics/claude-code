#!/usr/bin/env bats
# Tests for CIDR validation logic in init-firewall.sh

load '../../test-helper'

setup() {
  test_setup
}

teardown() {
  test_teardown
}

@test "accepts valid IPv4 CIDR notation" {
  run validate_cidr "192.168.1.0/24"
  assert_success

  run validate_cidr "10.0.0.0/8"
  assert_success

  run validate_cidr "172.16.0.0/12"
  assert_success

  run validate_cidr "192.30.252.0/22"
  assert_success
}

@test "accepts CIDR with /0 prefix" {
  run validate_cidr "0.0.0.0/0"
  assert_success
}

@test "accepts CIDR with /32 prefix (single host)" {
  run validate_cidr "192.168.1.1/32"
  assert_success
}

@test "rejects CIDR without slash" {
  run validate_cidr "192.168.1.0"
  assert_failure
}

@test "rejects CIDR with invalid IP octets" {
  run validate_cidr "256.168.1.0/24"
  assert_failure

  run validate_cidr "192.256.1.0/24"
  assert_failure

  run validate_cidr "192.168.256.0/24"
  assert_failure

  run validate_cidr "192.168.1.256/24"
  assert_failure
}

@test "rejects CIDR with invalid prefix length" {
  run validate_cidr "192.168.1.0/33"
  assert_failure

  run validate_cidr "192.168.1.0/100"
  assert_failure
}

@test "rejects CIDR with too few octets" {
  run validate_cidr "192.168.1/24"
  assert_failure

  run validate_cidr "192.168/16"
  assert_failure
}

@test "rejects CIDR with too many octets" {
  run validate_cidr "192.168.1.0.1/24"
  assert_failure
}

@test "rejects CIDR with non-numeric octets" {
  run validate_cidr "abc.def.ghi.jkl/24"
  assert_failure

  run validate_cidr "192.abc.1.0/24"
  assert_failure
}

@test "rejects CIDR with spaces" {
  run validate_cidr "192.168.1.0 /24"
  assert_failure

  run validate_cidr "192.168.1.0/ 24"
  assert_failure
}

@test "rejects empty CIDR" {
  run validate_cidr ""
  assert_failure
}

@test "rejects CIDR with special characters" {
  run validate_cidr "192.168.1.0/24; rm -rf /"
  assert_failure

  run validate_cidr "\$INJECT/24"
  assert_failure
}
