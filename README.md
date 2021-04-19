# demo-code-build








## Pipeline setup

sam build --template Setup.yml -b .aws-sam/build --debug
sam deploy --stack-name=Setup-Pipeline --s3-prefix=poc-setup-pipeline --profile=team --s3-bucket=au-slyp-team-sam-merchant-infra --capabilities CAPABILITY_NAMED_IAM

## Command that copy Template to S3 Bucket
aws --profile team s3 cp TemplatePipeline.yml s3://"$(aws --profile team sts get-caller-identity --query Account --output text)"-templates/ --acl private


sam build --template TemplatePipeline.yml -b .aws-sam/build --debug
sam deploy --profile team --stack-name Repo-demo-code-build --template-file TemplatePipeline.yml --parameter-overrides RepositoryName=demo-code-build Setup=true --region ap-southeast-2 --capabilities CAPABILITY_NAMED_IAM