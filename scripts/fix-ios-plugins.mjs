#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const configPath = resolve('ios/App/App/capacitor.config.json')
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const localPlugins = ['WatchConnectivityPlugin']
const existing = Array.isArray(config.packageClassList) ? config.packageClassList : []

config.packageClassList = [...new Set([...existing, ...localPlugins])]
writeFileSync(configPath, `${JSON.stringify(config, null, '\t')}\n`)
