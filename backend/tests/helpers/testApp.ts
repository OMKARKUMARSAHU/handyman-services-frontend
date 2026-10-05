import request from "supertest";
import { createApp } from "../../src/app";

/** One Express app instance per test file, driven by supertest with no real network socket. */
export function testAgent() {
  return request(createApp());
}
