#!/usr/bin/env bats
# Tests for IP validation logic in init-firewall.sh

load '../../test-helper'

setup() {
  test_setup
}

teardown() {
  test_teardown
}

@test "accepts valid IPv4 addresses" {
  run validate_ip "192.168.1.1"
  assert_success

  run validate_ip "10.0.0.1"
  assert_success

  run validate_ip "172.16.0.1"
  assert_success

  run validate_ip "255.255.255.255"
  assert_success

  run validate_ip "0.0.0.0"
  assert_success
}

@test "accepts IP with leading zeros in octets" {
  run validate_ip "192.168.001.001"
  assert_success

  run validate_ip "010.000.000.001"
  assert_success
}

@test "rejects IP with invalid octet values" {
  run validate_ip "256.168.1.1"
  assert_failure

  run validate_ip "192.256.1.1"
  assert_failure

  run validate_ip "192.168.256.1"
  assert_failure

  run validate_ip "192.168.1.256"
  assert_failure

  run validate_ip "999.999.999.999"
  assert_failure
}

@test "rejects IP with too few octets" {
  run validate_ip "192.168.1"
  assert_failure

  run validate_ip "192.168"
  assert_failure

  run validate_ip "192"
  assert_failure
}

@test "rejects IP with too many octets" {
  run validate_ip "192.168.1.1.1"
  assert_failure

  run validate_ip "192.168.1.1.1.1"
  assert_failure
}

@test "rejects IP with non-numeric octets" {
  run validate_ip "abc.def.ghi.jkl"
  assert_failure

  run validate_ip "192.abc.1.1"
  assert_failure

  run validate_ip "192.168.xyz.1"
  assert_failure
}

@test "rejects IP with spaces" {
  run validate_ip "192.168.1.1 "
  assert_failure

  run validate_ip " 192.168.1.1"
  assert_failure

  run validate_ip "192. 168.1.1"
  assert_failure
}

@test "rejects empty IP" {
  run validate_ip ""
  assert_failure
}

@test "rejects IP with CIDR notation" {
  run validate_ip "192.168.1.1/24"
  assert_failure
}

@test "rejects IP with special characters" {
  run validate_ip "192.168.1.1; rm -rf /"
  assert_failure

  run validate_ip "\$INJECT"
  assert_failure

  run validate_ip "192.168.1.1\$(whoami)"
  assert_failure
}

@test "rejects IPv6 addresses (not supported by current regex)" {
  run validate_ip "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
  assert_failure

  run validate_ip "::1"
  assert_failure

  run validate_ip "fe80::1"
  assert_failure
}
