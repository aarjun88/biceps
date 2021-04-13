resource aksCluster 'Microsoft.ContainerService/managedClusters@2020-02-01' = {
  name: 'aksCluster'
  location: resourceGroup().location
  properties: {
    kubernetesVersion: '1.15.7'
    dnsPrefix: 'testDnsPrefix'
    agentPoolProfiles: [
      {
        name: 'agentpool'
        count: 2
        vmSize: 'Standard_A1'
        osType: 'Linux'
      }
    ]
    linuxProfile: {
      adminUsername: 'testUser'
      ssh: {
        publicKeys: [
          {
            keyData: 'testKeyData'
          }
        ]
      }
    }
    servicePrincipalProfile: {
      clientId: 'testId'
      secret: 'testPassword'
    }
  }
}
