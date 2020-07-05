import * as os from 'os'
import * as path from 'path'
import * as util from 'util'
import * as fs from 'fs'

import * as toolCache from '@actions/tool-cache'
import * as core from '@actions/core'

const defaultKubectlVersion = '1.18.2'
const defaultKustomizeVersion = '3.5.5'
const defaultHelmVersion = '2.16.7'
const defaultHelmv3Version = '3.2.1'
const defaultKubevalVersion = '0.15.0'
const defaultConftestVersion = '0.19.0'
const defaultYqVersion = 'latest'

interface Tool {
  name: string
  defaultVersion: string
  isArchived: boolean
  commandPathInPackage: string
}

const Tools: Tool[] = [
  {
    name: 'kubectl',
    defaultVersion: defaultKubectlVersion,
    isArchived: false,
    commandPathInPackage: 'kubectl'
  },
  {
    name: 'kustomize',
    defaultVersion: defaultKustomizeVersion,
    isArchived: true,
    commandPathInPackage: 'kustomize'
  },
  {
    name: 'helm',
    defaultVersion: defaultHelmVersion,
    isArchived: true,
    commandPathInPackage: 'linux-amd64/helm'
  },
  {
    name: 'helmv3',
    defaultVersion: defaultHelmv3Version,
    isArchived: true,
    commandPathInPackage: 'linux-amd64/helm'
  },
  {
    name: 'kubeval',
    defaultVersion: defaultKubevalVersion,
    isArchived: true,
    commandPathInPackage: 'kubeval'
  },
  {
    name: 'conftest',
    defaultVersion: defaultConftestVersion,
    isArchived: true,
    commandPathInPackage: 'conftest'
  },
  {
    name: 'yq',
    defaultVersion: defaultYqVersion,
    isArchived: false,
    commandPathInPackage: 'yq_linux_amd64'
  }
]

function getDownloadURL(commandName: string, version: string): string {
  switch (commandName) {
    case 'kubectl':
      return util.format(
        'https://storage.googleapis.com/kubernetes-release/release/v%s/bin/linux/amd64/kubectl',
        version
      )
    case 'kustomize':
      return util.format(
        'https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2Fv%s/kustomize_v%s_linux_amd64.tar.gz',
        version,
        version
      )
    case 'helm':
      return util.format(
        'https://get.helm.sh/helm-v%s-linux-amd64.tar.gz',
        version
      )
    case 'helmv3':
      return util.format(
        'https://get.helm.sh/helm-v%s-linux-amd64.tar.gz',
        version
      )
    case 'kubeval':
      return util.format(
        'https://github.com/instrumenta/kubeval/releases/download/%s/kubeval-linux-amd64.tar.gz',
        version
      )
    case 'conftest':
      return util.format(
        'https://github.com/open-policy-agent/conftest/releases/download/v%s/conftest_%s_Linux_x86_64.tar.gz',
        version,
        version
      )
    case 'yq':
      return util.format(
        'https://github.com/mikefarah/yq/releases/%s/download/yq_linux_amd64',
        version
      )
    default:
      return ''
  }
}

async function downloadTool(version: string, tool: Tool): Promise<string> {
  let cachedToolpath = toolCache.find(tool.name, version)
  let commandPath = ''

  if (!cachedToolpath) {
    const downloadURL = getDownloadURL(tool.name, version)
    // eslint-disable-next-line no-console
    // DEBUGj
    console.log( `downloadURL = ${downloadURL}`)

    try {
      const packagePath = await toolCache.downloadTool(downloadURL)
      // eslint-disable-next-line no-console
      // DEBUGj
      console.log( `packagePath = ${packagePath}`)

      if (tool.isArchived) {
        const extractedPath = util.format('%s_%s', packagePath, tool.name)
        // eslint-disable-next-line no-console
        // DEBUGj
        console.log( `extractedPath = ${extractedPath}`)

        fs.mkdirSync(extractedPath)

        const extractedDir = await toolCache.extractTar(
          packagePath,
          extractedPath
        )
        commandPath = util.format(
          '%s/%s',
          extractedDir,
          tool.commandPathInPackage
        )
        // eslint-disable-next-line no-console
        // DEBUGj
        console.log( `commandPath = ${commandPath}`)
      } else {
        commandPath = packagePath
      }
    } catch (exception) {
      throw new Error(`Download ${tool.name} Failed! (url: ${downloadURL})`)
    }
    cachedToolpath = await toolCache.cacheFile(
      commandPath,
      tool.name,
      tool.name,
      version
    )
  }

  const ecctlPath = path.join(cachedToolpath, tool.name)
  fs.chmodSync(ecctlPath, '777')
  return ecctlPath
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function run() {
  if (!os.type().match(/^Linux/)) {
    throw new Error('The action only support Linux OS!')
  }

  // eslint-disable-next-line github/array-foreach
  Tools.forEach(async function(tool) {
    let toolVersion = core.getInput(tool.name, {required: false})
    if (!toolVersion) {
      toolVersion = tool.defaultVersion
    }
    const cachedPath = await downloadTool(toolVersion, tool)
    core.addPath(path.dirname(cachedPath))
    // eslint-disable-next-line no-console
    console.log(
      `${tool.name} version '${toolVersion}' has been cached at ${cachedPath}`
    )
    core.setOutput(`${tool.name}-path`, cachedPath)
  })
}

run().catch(core.setFailed)
