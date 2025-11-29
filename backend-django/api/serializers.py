from rest_framework import serializers
from .models import Company, Member, PensionAccount, Transaction, AssumptionSet, CustomUser


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = '__all__'


class PensionAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = PensionAccount
        fields = '__all__'


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'


class AssumptionSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssumptionSet
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ('id', 'username', 'email', 'is_company_user', 'is_talent_verify')
        read_only_fields = ('id',)
