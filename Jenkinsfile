node {
  env.NPM_CONFIG_CACHE = 'npm-cache'
  checkout scm

  docker.image('node:8').inside {
    stage('Install') {
      sh 'npm install'
    }

    stage('Test') {
      sh 'npm test'
    }

    stage('Build') {
      sh 'npm run build'
    }
  }
}
