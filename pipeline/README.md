$(aws cloudformation list-exports --query "Exports[?Name=='SamBucket'].Value" --output text)



aws cloudformation package --template-file sample.yml --output-template-file sample-transformed.yml --s3-bucket $(aws cloudformation list-exports --query "Exports[?Name=='SamBucket'].Value" --output text)
aws cloudformation deploy --template-file sample-transformed.yml --stack-name sample-project  --capabilities CAPABILITY_IAM